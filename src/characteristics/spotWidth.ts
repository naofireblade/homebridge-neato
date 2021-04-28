import type { Characteristic, WithUUID } from 'homebridge';
import { Formats, Perms } from 'homebridge';

export default function spotWidth(CustomCharacteristic: typeof Characteristic): WithUUID<new () => Characteristic> {
	return class SpotWidth extends CustomCharacteristic {
		static readonly UUID = 'A7889A9A-2F27-4293-BEF8-3FE805B36F4E';

		constructor() {
			super('Spot ↔', SpotWidth.UUID, {
				format: Formats.INT,
				unit: 'cm',
				maxValue: 400,
				minValue: 100,
				minStep: 50,
				perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
			});
		}
	};
}