import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../application/auth.service';
import { MIN_PASSWORD_LENGTH, isStrongPassword } from '../../domain/password';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTabsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly registering = signal(false);
  protected readonly error = signal('');
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly minLength = MIN_PASSWORD_LENGTH;
  protected username = '';
  protected password = '';

  protected setMode(index: number) {
    this.registering.set(index === 1);
    this.error.set('');
  }

  /** Registering requires a strong password; signing in only needs one (older accounts may have short ones). */
  protected get passwordOk() {
    return this.registering() ? isStrongPassword(this.password) : this.password.length > 0;
  }

  protected get canSubmit() {
    return this.username.trim().length > 0 && this.passwordOk && !this.submitting();
  }

  protected async submit() {
    if (!this.canSubmit) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      if (this.registering()) await this.auth.register(this.username, this.password);
      else await this.auth.login(this.username, this.password);
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
