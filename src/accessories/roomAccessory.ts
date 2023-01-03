import {CharacteristicValue, Logger, PlatformAccessory, PlatformAccessoryEvent, PlatformConfig, Service, WithUUID} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import {CleanType, RobotService} from "../models/services";
import {AbstractAccessory} from "./abstractAccessory";

export class RoomAccessory extends AbstractAccessory
{
	// Context
	private room: any;
	private isCleaning: boolean = false;

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
			await this.robot.getState(() => {});
			this.isCleaning = this.robot.canPause;
			return this.robot.canPause;
		}
		catch (error)
		{
			this.log.error("[" + this.robot.name + "] Cannot get room cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setRoomClean(on: CharacteristicValue)
	{
		this.log.debug("[" + this.robot.name + "] Clean room " + on ? 'start' : 'pause' + ".");
		try
		{
			// await this.updateRobot();

			// Start
			if (on)
			{
				this.log.info(
						"[" + this.robot.name + "] > Start cleaning room: " + [this.room.name] + " (" + this.room.id + ") with options eco: " + this.robot.options.eco + ", extraCare: "
						+ this.robot.options.extraCare);
				await this.robot.startCleaningBoundary(this.robot.options.eco, this.robot.options.extraCare ? 2 : 1, this.room.id);

				this.isCleaning = true;
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
