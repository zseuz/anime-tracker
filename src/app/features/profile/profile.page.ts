import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../application/auth.service';
import { AvatarId } from '../../domain/models';
import { MIN_PASSWORD_LENGTH, isStrongPassword } from '../../domain/password';
import { AVATAR_STYLES, avatarGradient } from '../../shared/avatar';
import { Breadcrumbs, Crumb } from '../../shared/breadcrumbs/breadcrumbs';

const MAX_USERNAME = 50;

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, Breadcrumbs, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly crumbs: Crumb[] = [{ label: 'Explorar', link: '/' }, { label: 'Mi perfil' }];
  protected readonly avatars = AVATAR_STYLES;
  protected readonly maxUsername = MAX_USERNAME;
  protected readonly minPassword = MIN_PASSWORD_LENGTH;
  protected readonly gradient = avatarGradient;

  // --- Profile ---------------------------------------------------------
  protected username = this.auth.user() ?? '';
  protected readonly avatar = signal<AvatarId>(this.auth.avatar());
  protected readonly profileMessage = signal('');
  protected readonly profileError = signal('');
  protected readonly savingProfile = signal(false);

  protected readonly accountName = this.auth.user;

  /** Initial shown in the preview; follows the username being typed. */
  protected get initial() {
    return (this.username.trim() || this.auth.user() || '?').charAt(0).toUpperCase();
  }

  protected get usernameValid() {
    const name = this.username.trim();
    return name.length >= 1 && name.length <= MAX_USERNAME;
  }

  protected get profileChanged() {
    return this.username.trim() !== this.auth.user() || this.avatar() !== this.auth.avatar();
  }

  protected get canSaveProfile() {
    return this.usernameValid && this.profileChanged && !this.savingProfile();
  }

  protected pickAvatar(id: AvatarId) {
    this.avatar.set(id);
    this.profileMessage.set('');
  }

  protected async saveProfile() {
    if (!this.canSaveProfile) return;
    this.savingProfile.set(true);
    this.profileError.set('');
    this.profileMessage.set('');
    try {
      const changes: { username?: string; avatar?: AvatarId } = {};
      if (this.username.trim() !== this.auth.user()) changes.username = this.username.trim();
      if (this.avatar() !== this.auth.avatar()) changes.avatar = this.avatar();
      await this.auth.updateProfile(changes);
      this.username = this.auth.user() ?? this.username;
      this.profileMessage.set('Perfil actualizado.');
    } catch (e) {
      this.profileError.set((e as Error).message);
    } finally {
      this.savingProfile.set(false);
    }
  }

  // --- Password --------------------------------------------------------
  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';
  protected readonly showPasswords = signal(false);
  protected readonly passwordMessage = signal('');
  protected readonly passwordError = signal('');
  protected readonly savingPassword = signal(false);

  protected get passwordMismatch() {
    return this.confirmPassword.length > 0 && this.confirmPassword !== this.newPassword;
  }

  protected get canChangePassword() {
    return (
      this.currentPassword.length > 0 &&
      isStrongPassword(this.newPassword) &&
      this.newPassword === this.confirmPassword &&
      this.newPassword !== this.currentPassword &&
      !this.savingPassword()
    );
  }

  protected async changePassword() {
    if (!this.canChangePassword) return;
    this.savingPassword.set(true);
    this.passwordError.set('');
    this.passwordMessage.set('');
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = this.newPassword = this.confirmPassword = '';
      this.passwordMessage.set('Contraseña actualizada.');
    } catch (e) {
      this.passwordError.set((e as Error).message);
    } finally {
      this.savingPassword.set(false);
    }
  }

  // --- Delete account --------------------------------------------------
  protected readonly confirmingDelete = signal(false);
  protected deletePassword = '';
  protected readonly deleteError = signal('');
  protected readonly deleting = signal(false);

  protected startDelete() {
    this.confirmingDelete.set(true);
    this.deleteError.set('');
  }

  protected cancelDelete() {
    this.confirmingDelete.set(false);
    this.deletePassword = '';
    this.deleteError.set('');
  }

  protected async deleteAccount() {
    if (!this.deletePassword || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    try {
      await this.auth.deleteAccount(this.deletePassword);
      await this.router.navigateByUrl('/login');
    } catch (e) {
      this.deleteError.set((e as Error).message);
    } finally {
      this.deleting.set(false);
    }
  }
}
