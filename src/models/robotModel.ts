import {Robot} from "node-botvac";
import {Options} from "./options";

export class RobotModel extends Robot
{
    [x: string]: any;
	public options: Options;

	constructor(name, serial, secret, token, options)
	{
		super(name, serial, secret, token);

		this.options = options || new Options();
	}
}	