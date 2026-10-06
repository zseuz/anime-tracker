import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface Crumb {
  label: string;
  /** Route commands; omit for the current page (last crumb). */
  link?: string | readonly unknown[];
}

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, MatIconModule],
  templateUrl: './breadcrumbs.html',
  styleUrl: './breadcrumbs.scss',
})
export class Breadcrumbs {
  readonly items = input.required<readonly Crumb[]>();

  protected commands(link: Crumb['link']): readonly unknown[] {
    return typeof link === 'string' ? [link] : (link ?? []);
  }
}
