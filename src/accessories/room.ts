import {CharacteristicValue, Logger, PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';

export class RoomAccessory
{
	private robot: any;
	private log: Logger;
	private readonly refresh: any;

	constructor(
			private readonly platform: HomebridgeNeatoPlatform,
			private readonly accessory: PlatformAccessory,
			private readonly config: PlatformConfig)
	{
		this.log = platform.log;
	}

	async setCleanRoom()
	{
		
	}
}
