import {CharacteristicValue, Logger, PlatformAccessory, PlatformConfig, Service, WithUUID} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import {Options} from "../models/options";
import {CleanType, RobotService} from "../models/services";
import {CharacteristicHandler} from "../characteristics/characteristicHandler";
import {availableLocales, localize} from "../localization";
import {ALL_SERVICES, LOCALE, PREFIX} from "../defaults";

export class AbstractRobot
{
	protected robot: any;
	protected log: Logger;
	protected cleanService?: Service;
	protected readonly refresh: any;

	// Context
	protected found: boolean;
	
	// Config
	protected readonly prefix: boolean;
	protected readonly locale: availableLocales;
	protected readonly availableServices: Set<RobotService>;

	constructor(
			protected readonly platform: HomebridgeNeatoPlatform,
			protected readonly accessory: PlatformAccessory,
			protected readonly config: PlatformConfig)
	{
		this.log = platform.log;
		this.found = accessory.context.found;
		this.prefix = this.config['prefix'] || PREFIX;
		this.locale = this.config['language'] || LOCALE;
		this.availableServices = new Set(this.config['services']) || ALL_SERVICES;

		// Information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Manufacturer, "Neato Robotics")
				.setCharacteristic(this.platform.Characteristic.Model, this.robot.meta.modelName)
				.setCharacteristic(this.platform.Characteristic.SerialNumber, this.robot._serial)
				.setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.robot.meta.firmware);
	}

	protected async pause()
	{
		if (this.robot.canPause)
		{
			this.debug(DebugType.ACTION, "Pause cleaning");
			await this.robot.pauseCleaning();
		}
		else
		{
			this.debug(DebugType.INFO, "Already paused");
		}
	}

	protected async clean(cleanType: CleanType)
	{
		// Enable shorter background update while cleaning
		setTimeout(() => {
			this.updateRobotPeriodically();
		}, 2 * 60 * 1000);

		this.log.info(
				"[" + this.robot.name + "] > Start cleaning with options type: " + CleanType[cleanType] + ", eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: "
				+ this.options.extraCare);

		try
		{
			switch (cleanType)
			{
				case CleanType.ALL:
					await this.robot.startCleaning(this.options.eco, this.options.extraCare ? 2 : 1, this.options.noGoLines);
					break;
				case CleanType.SPOT:
					await this.robot.startSpotCleaning(this.options.eco, this.options.spotWidth, this.options.spotHeight, this.options.spotRepeat, this.options.extraCare ? 2 : 1);
					break;
			}
		}
		catch (error)
		{
			this.log.error("Cannot start cleaning. " + error);
		}
	}

	protected async updateRobot()
	{
		// Data is outdated
		if (typeof (this.robot.lastUpdate) === 'undefined' || new Date().getTime() - this.robot.lastUpdate > 2000)
		{
			this.robot.lastUpdate = new Date().getTime();
			try
			{
				this.robot.getState((error, result) => {
					this.isSpotCleaning = result != null && result.action == 2;

					// Battery
					this.batteryService?.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.robot.charge);
					this.batteryService?.updateCharacteristic(this.platform.Characteristic.ChargingState, this.robot.isCharging);
				});
			}
			catch (error)
			{
				this.log.error("Cannot update robot " + this.robot.name + ". Check if robot is online. " + error);
				return false;
			}
		}
	}

	protected registerService(serviceName: RobotService, serviceType: WithUUID<typeof Service>, characteristicHandlers: CharacteristicHandler[] = []): Service | undefined
	{
		const displayName = (this.prefix ? (this.robot.name + " ") : "") + localize(serviceName, this.locale);

		// query existing service by type and subtype
		const existingService = this.accessory.getServiceById(serviceType, serviceName)

		if (this.availableServices.has(serviceName))
		{
			let service: Service;
			if (existingService && existingService.displayName === displayName)
			{
				service = existingService
			}
			else
			{
				if (existingService)
				{
					// delete to reset display name in case of locale or prefix change
					this.accessory.removeService(existingService);
				}
				service = this.accessory.addService(serviceType, displayName, serviceName);
			}
			characteristicHandlers.forEach(handlers => {
				let characteristic = service.getCharacteristic(handlers.characteristic);
				if (handlers.getCharacteristicHandler)
				{
					characteristic.onGet(handlers.getCharacteristicHandler)
				}
				if (handlers.setCharacteristicHandler)
				{
					characteristic.onSet(handlers.setCharacteristicHandler)
				}
			});
			return service
		}
		else
		{
			if (existingService)
			{
				this.accessory.removeService(existingService);
			}
		}
	}
}
