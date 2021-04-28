import type { Characteristic, WithUUID } from 'homebridge';
import { Formats, Perms } from 'homebridge';

export default function spotHeight(CustomCharacteristic: typeof Characteristic): WithUUID<new () => Characteristic> {
	return class SpotHeight extends CustomCharacteristic {
		static readonly UUID = 'CA282DB2-62BF-4325-A1BE-F8BB5478781A';

		constructor() {
			super('Spot ↕', SpotHeight.UUID, {
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