import {HomebridgeNeatoPlatform} from "../homebridgeNeatoPlatform";
import {PlatformAccessory, PlatformConfig} from "homebridge";

export class Options
{
	public eco: boolean;
	public extraCare: boolean;
	public noGoLines: boolean;
	public spot: any;
	
	constructor()
	{
		this.eco = false;
		this.extraCare = false;
		this.noGoLines = false;
		this.spot = {};
	}
}	