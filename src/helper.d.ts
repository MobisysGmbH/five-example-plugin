/// <reference path="../types/core.d.ts" />

import type { Api } from 'core/interfaces/api';
import type { Authentication as IAuth } from 'core/authentication/authentication.class';

declare global {
  const Authentication: typeof IAuth;
  
  // cordova plugins
  const cordova: any;

  // core API for privileged plugins
  const API: Api | undefined;
}