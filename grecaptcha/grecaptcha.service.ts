import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  GRECAPTCHA_LANGUAGE,
  GRECAPTCHA_SETTINGS,
  GrecaptchaSettings,
  IRecaptchaResponse,
} from './grecaptcha.model';

@Injectable()
export class GrecaptchaService {

  private v2SiteKey: string;
  private v3SiteKey: string;
  private theme: ReCaptchaV2.Theme;
  private type: ReCaptchaV2.Type;
  private size: ReCaptchaV2.Size;
  private badge: ReCaptchaV2.Badge;
  private language: string = '';
  private v2RenderScriptStatus: boolean = false;
  private v3RenderScriptStatus: boolean = false;
  private isScriptLoaded = new Subject<boolean>();
  private returnV2Token = new Subject<IRecaptchaResponse>();

  constructor(@Optional() @Inject(GRECAPTCHA_SETTINGS) settings?: GrecaptchaSettings,
              @Optional() @Inject(GRECAPTCHA_LANGUAGE) language?: string) {
    if (settings) {
      this.v2SiteKey = settings.v2SiteKey;
      this.v3SiteKey = settings.v3SiteKey;
      this.theme = settings.theme;
      this.type = settings.type;
      this.size = settings.size;
      this.badge = settings.badge;
    }
    if (language) {
      this.language = language;
    }
  }

  public initializeRecaptcha(showV2Captcha: boolean, showV3Captcha: boolean, gRecaptchaId: string, callback: (callback: number) => void) {
    this.callRecaptchaAPI(showV2Captcha, showV3Captcha);
    this.captchaScriptStatus().pipe(take(1)).subscribe((status: boolean) => {
      if (status && (this.v2SiteKey && (this.checkUserInput(showV2Captcha)))) {
        this.renderV2Captch(gRecaptchaId).then((id: number) => {
          callback(id);
        });
      }
    });
  }

  // For executing V2 Recaptcha
  public executeV2Captcha(gRecaptchaId: string, callback: (callback: IRecaptchaResponse) => void) {
    grecaptcha.ready(() => {
      grecaptcha.execute(this.getWidgetId(gRecaptchaId));
      this.getV2CaptchaToken().pipe(take(1)).subscribe((res: IRecaptchaResponse) => {
        callback(res);
      },
      (error) => {
        callback(error);
      });
    });
  }

  // For executing V3 Recaptcha
  public executeV3Captcha(gRecaptchaId: string, actionName: string, callback: (callback: IRecaptchaResponse) => void) {
    grecaptcha.ready(() => {
      grecaptcha.execute(this.v3SiteKey, { action: actionName ? actionName : gRecaptchaId }).then((v3token: string) => {
        callback({
          type: 'v3',
          gRecaptchaId,
          token: v3token,
          action: actionName || gRecaptchaId
        });
      });
    });
  }

  // Get widget id and it's applicable only for V2
  public getWidgetId(gRecaptchaId: string): number {
    if (document.getElementById('grecaptcha-' + gRecaptchaId.split(' ').join(''))) {
      return parseInt(document.getElementById('grecaptcha-' + gRecaptchaId.split(' ').join('')).getAttribute('data-widgetid'));
    }
    return null;
  }

  // Applicable only for V2
  public getCaptchaResponse(widgetId?: number): string {
    if (typeof grecaptcha !== 'undefined' && widgetId) {
      return grecaptcha.getResponse(widgetId);
    } else if (typeof grecaptcha !== 'undefined') {
      return grecaptcha.getResponse();
    }
  }

  // Getter method to check the script loaded status
  public captchaScriptStatus(): Observable<boolean> {
    return this.isScriptLoaded.asObservable();
  }

  private getV2CaptchaToken(): Observable<IRecaptchaResponse> {
    return this.returnV2Token.asObservable();
  }

  // Resetting Recaptcha
  public resetCaptcha(widgetId?: number) {
    if (typeof grecaptcha !== 'undefined' && widgetId) {
      grecaptcha.reset(widgetId);
    } else if (typeof grecaptcha !== 'undefined') {
      grecaptcha.reset();
    }
  }

  private checkUserInput(input: boolean): boolean {
    return (input === undefined || input) ? true : false;
  }

  private callRecaptchaAPI(showV2Captcha: boolean, showV3Captcha: boolean) {
    if (this.v3SiteKey && this.checkUserInput(showV3Captcha) && !this.v3RenderScriptStatus) {
      this.appendRecaptchaAPI('v3', 'https://www.google.com/recaptcha/api.js?render=' + this.v3SiteKey
        + '&hl=' + this.language);
      this.v3RenderScriptStatus = true;
    } else if (this.v2SiteKey && this.checkUserInput(showV2Captcha) && !this.v2RenderScriptStatus && !this.v2RenderScriptStatus) {
      this.appendRecaptchaAPI('v2', 'https://www.google.com/recaptcha/api.js?render=explicit&hl=' + this.language);
      this.v2RenderScriptStatus = true;
    }
  }

  private appendRecaptchaAPI(type: string, url?: string) {
    const script = document.createElement('script');
    script.innerHTML = '';
    const srcUrl = url || 'https://www.google.com/recaptcha/api.js';
    script.src = srcUrl;
    script.id = `${type}-grecaptcha-script`;
    script.async = false;
    script.defer = true;
    document.head.appendChild(script);
    script.onload = () => {
      // This will help to check and render the V2 Recaptcha
      this.isScriptLoaded.next(true);
    };
    script.onerror = () => {
      // For rare-case scenario
      document.getElementsByTagName('head')[0].appendChild(script);
    };
  }

  // Only needed for rendering V2 Recaptcha
  private renderV2Captch(id: string): Promise<number> {
    return new Promise<number>(resolve => {
      grecaptcha.ready(() => {
        resolve(grecaptcha.render(document.getElementById('grecaptcha-' + id.split(' ').join('')), {
          sitekey: this.v2SiteKey,
          badge: this.badge,
          theme: this.theme,
          size: this.size,
          type: this.type,
          callback: this.recaptchaV2Callback.bind(this, id),
          'expired-callback': this.resetCaptcha.bind(this),
        }));
      });
    });
  }

  // On V2 Recaptcha execution this callback function is called
  private recaptchaV2Callback(id: string, v2token: string) {
    if (v2token) {
      this.returnV2Token.next({
        type: 'v2',
        gRecaptchaId: id,
        token: v2token,
      });
    }
  }
}
