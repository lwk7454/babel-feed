import { Pipe, PipeTransform, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Make it impure so it updates when language changes
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private subscription?: Subscription;
  private lastKey?: string;
  private lastParams?: { [key: string]: string | number };
  private lastValue?: string;

  constructor(private translationService: TranslationService) {}

  transform(key: string, params?: { [key: string]: string | number }): string {
    // If key or params changed, update the translation
    if (key !== this.lastKey || JSON.stringify(params) !== JSON.stringify(this.lastParams)) {
      this.lastKey = key;
      this.lastParams = params;
      this.updateTranslation();
    }

    return this.lastValue || key;
  }

  private updateTranslation(): void {
    if (this.lastKey) {
      this.lastValue = this.translationService.translate(this.lastKey, this.lastParams);
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
} 