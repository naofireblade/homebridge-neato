import type { Characteristic, WithUUID } from 'homebridge';
import { Formats, Perms } from 'homebridge';

export default function spotRepeat(CustomCharacteristic: typeof Characteristic): WithUUID<new () => Characteristic> {
	return class SpotRepeat extends CustomCharacteristic {
		static readonly UUID = '1E79C603-63B8-4E6A-9CE1-D31D67981831';

		constructor() {
			super('Spot 2x', SpotRepeat.UUID, {
				format: Formats.BOOL,
				perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
			});
		}
	};
}