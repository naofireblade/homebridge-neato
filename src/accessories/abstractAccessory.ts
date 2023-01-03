import {CharacteristicValue, Logger, PlatformAccessory, PlatformConfig, Service, WithUUID} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import {Options} from "../models/options";
import {CleanType, RobotService} from "../models/services";
import {CharacteristicHandler} from "../characteristics/characteristicHandler";
import {availableLocales, localize} from "../localization";
import {ALL_SERVICES, LOCALE, PREFIX} from "../defaults";
import {RobotModel} from "../models/robotModel";

export class AbstractAccessory
{
	protected robot: RobotModel; // Physicial robot
	protected log: Logger; // Homebridge Logger
	protected cleanService?: Service; // Service for start cleaning
	// protected readonly refresh: any; // ???

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
		this.robot = accessory.context.robot;
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
				this.log.debug("Already found service with same name: " + displayName)
			}
			else
			{
				if (existingService)
				{
					// delete to reset display name in case of locale or prefix change
					this.accessory.removeService(existingService);
					this.log.debug("Already found service. Removing to update name: " + existingService.displayName)
				}
				service = this.accessory.addService(serviceType, displayName, serviceName);
				this.log.debug("Added service: " + displayName)
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
				this.log.info("Removed service because its no longer configured: " + existingService.displayName)
			}
			else
			{
				this.log.info("Skipped service because its not configured: " + displayName)
			}
		}
	}

	protected debug(debugType: DebugType, message: String)
	{
		switch (debugType)
		{
			case DebugType.ACTION:
				this.log.debug("[" + this.robot.name + "] > " + message);
				break;
			case DebugType.STATUS:
				this.log.debug("[" + this.robot.name + "] " + message);
				break;
			case DebugType.INFO:
				this.log.debug("[" + this.robot.name + "] " + message);
				break;
		}
	}
}

export enum DebugType
{
	ACTION,
	STATUS,
	INFO
}
