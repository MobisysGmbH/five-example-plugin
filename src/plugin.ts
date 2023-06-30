import type { IAuthenticationInput, IAuthenticationOutput, RequestModuleFN } from 'core/authentication/authentication.interfaces';

const LOGGER_PREFIX = '[API::Authentication::FIVEWebForm]';
const translationComponent = 'FIVEWebformSSOPlugin';

export class FIVEWebFormAuthWithSSO extends Authentication {
  public static type = 'five-plugin-webform-sso-v1';
  public static title = `${translationComponent}:title`;

  public static async onRegister(requestModule: RequestModuleFN) {
    const i18n = await requestModule('i18n');

    const translationObjectEN = {
      'title': 'WebForm SSO Plugin',
      'cookienames': 'Cookie names'
    };

    const translationObjectDE = {
      'title': 'WebForm SSO Plugin',
      'cookienames': 'Cookie-Namen'
    };

    i18n.expandTranslations('en', translationComponent, translationObjectEN);
    i18n.expandTranslations('de', translationComponent, translationObjectDE);
  }

  public config!: Record<string, any> & Partial<{
    cookienames: string;
  }>;

  public readonly inputs: IAuthenticationInput[] = [
    {
      name: 'cookienames',
      type: 'string',
      required: true,
      settingsRequired: true,
      isUserInput: true,
      description: `${translationComponent}:cookienames`,
      defaultValue: 'SAP_SESSIONID'
    }
  ];

  public readonly outputs: IAuthenticationOutput[] = [
    { name: 'response', type: 'object', value: {} }
  ];

  public async authenticate(): Promise<Record<string, any>> {
    const iab = await this.requestModule('inappbrowser');
    const logger = await this.requestModule('logger');
    const util = await this.requestModule('util');
    const cookieModule = await this.requestModule('cookies');
    const authCommon = await this.requestModule('common');
    const http = await this.requestModule('http');
    const FusionError = await this.requestModule('error');

    const data: typeof this.config = await authCommon.validateAndRequest(this);

    // build url from profile
    const url = util.urlResolver.getBaseUrl!((data.server_type === 'pkgServer' || data.server_type.includes('package')) ? 'pkgServer' : 'dataServer', true);
    logger.debug(`Opening InAppBrowser with url "${url}"`);

    // TODO: make this a real module and capsulate the open call (reduce the size here)
    // open the browser
    const browser = await iab.open(url, '_blank');

    const promise = new Promise<void>((resolve, reject) => {
      const onError = (event) => {
        browser.removeEventListener('exit', onExit);
        browser.close();
        reject(new FusionError(event.message, 'WebFormAuthenticationError', event.code));
      };

      const onExit = (_evt) => {
        reject(new FusionError('Authentication was aborted.'));
      };

      const onLoadStop = async (event) => {
        logger.debug(`New page was loaded in InAppBrowser "${event.url}"`);

        const cookieNames = this.getCookieNames(data);
        const inAppBrowserCookieString = await iab.getCookieString(url);
        const inAppBrowserCookies: string[] = inAppBrowserCookieString?.split(';') || [];

        const cookies = cookieNames.map((cookieName) =>
          inAppBrowserCookies.find(cookie => cookie.trim().startsWith(cookieName))?.trim()
        ).filter((value) => !!value) as string[];

        if (cookies.length > 0) {
          logger.debug('Received matching authentication cookie!');

          for (const cookie of cookies) {
            await cookieModule.setCookie(url, cookie);
          }

          browser.removeEventListener('exit', onExit);
          browser.close();
          this.outputs[0].value = inAppBrowserCookieString;
          resolve();
        } else {
          logger.debug('Did not receive matching authentication cookie... waiting for next page load.');
        }
      };

      browser.addEventListener('exit', onExit);
      browser.addEventListener('loaderror', onError);
      browser.addEventListener('loadstop', onLoadStop);
    });

    try {
      // SAML2 login against idp/sp
      await promise;

      // workaround for inline redirects
      await http.setFollowRedirects(false);

      // Internal FIVE login
      const header = await authCommon.getGeneralHeader(this);
      const authData = await authCommon.generateAuthData(this, false);
      const response = await authCommon.sendDeviceLoginRequestToService(this, authData, header);

      this.outputs[0].value = response;
    } catch (err) {
      if (err instanceof FusionError) {
        logger.error(LOGGER_PREFIX, err.toString());
        throw err;
      } else {
        // timeout or real error
        const wrappedError = new FusionError('WebFormAuth did not function properly or was aborted.', 'WebFormAuthError', 403, { nested: err });
        logger.error(LOGGER_PREFIX, wrappedError.toString());
      }
    }

    return this.transform(this.outputs);
  }

  private getCookieNames(config?: Partial<{ cookienames: string; }>): string[] {
    return ((config || {}).cookienames || '')
      .split(',')
      .map((cookieName) => cookieName.trim());
  }

  public async cleanup(): Promise<any> {
    const logger = await this.requestModule('logger');
    const http = await this.requestModule('http');

    logger.debug('Cleaning up webform login session...');
    await http.clearCookies();
  }
}
