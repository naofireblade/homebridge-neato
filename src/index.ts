import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { HomebridgeNeatoPlatform } from './homebridgeNeatoPlatform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, HomebridgeNeatoPlatform);
};
