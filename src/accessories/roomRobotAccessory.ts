import {CharacteristicValue, Logger, PlatformAccessory, PlatformConfig, Service, WithUUID} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import {Options} from "../models/options";
import {CleanType, RobotService} from "../models/services";
import {CharacteristicHandler} from "../characteristics/characteristicHandler";
import {localize} from "../localization";
import {PREFIX} from "../defaults";
import {AbstractRobot} from "./abstractRobot";

export class RoomRobotAccessory extends AbstractRobot
{
	// Context
	private room: any;

	constructor(
			platform: HomebridgeNeatoPlatform,
			accessory: PlatformAccessory,
			config: PlatformConfig)
	{
		super(platform, accessory, config);

		this.room = this.accessory.context.room;

		// Information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Name, this.room.name);

		// Services
		this.cleanService = this.registerService(RobotService.CLEAN_ZONE, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getRoomClean.bind(this),
			setCharacteristicHandler: this.setRoomClean.bind(this)
		}]);
	}

	async getRoomClean(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.canPause;
		}
		catch (error)
		{
			this.log.error("[" + this.robot.name + "]Cannot get cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setRoomClean(on: CharacteristicValue)
	{
		this.log.debug("[" + this.robot.name + "] Clean room " + on ? 'start' : 'pause' + ".");
		try
		{
			await this.updateRobot();

			// Start
			if (on)
			{
				// Resume cleaning
				if (this.robot.canResume)
				{
					this.log.debug("[" + this.robot.name + "] Resume cleaning room");
					await this.robot.resumeCleaning();
				}
				// Start cleaning
				else if (this.robot.canStart)
				{
					await this.clean(CleanType.ALL)
				}
				// Cannot start
				else
				{
					this.log.debug("[" + this.robot.name + "] Cannot start cleaning room, maybe already cleaning?");
				}
			}
			// Stop
			else
			{
				await this.pause();
			}
		}
		catch (error)
		{
			this.log.error("Error setting cleaning to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}
}
