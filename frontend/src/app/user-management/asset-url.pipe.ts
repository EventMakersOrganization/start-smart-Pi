import { Pipe, PipeTransform } from '@angular/core';
import { assetUrl } from '../core/api-url';

/** Same-origin media URLs in production (nginx proxies /uploads, /api). */
@Pipe({ name: 'assetUrl' })
export class AssetUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null || value === '') return '';
    return assetUrl(String(value));
  }
}
