import {CharacteristicValue, Logger, PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import {Options} from "../models/options";

export class NeatoRoomAccessory
{
	private robot: any;
	private log: Logger;
	private readonly refresh: any;

	// Context
	private room: any;
	private found: boolean;

	constructor(
			private readonly platform: HomebridgeNeatoPlatform,
			private readonly accessory: PlatformAccessory,
			private readonly config: PlatformConfig)
	{
		this.log = platform.log;
		
		this.room = accessory.context.room;
		this.found = accessory.context.found;
	}

	async setCleanRoom()
	{
		
	}
}
