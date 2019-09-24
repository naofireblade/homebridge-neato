const inherits = require('util').inherits;

module.exports = function (Characteristic, CustomUUID)
{
	let SpotRepeat = function ()
	{
		Characteristic.call(this, 'Spot 2x', CustomUUID.SpotCleanRepeat);
		this.setProps({
			format: Characteristic.Formats.BOOL,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
		});
		this.value = this.getDefaultValue();
	};
	inherits(SpotRepeat, Characteristic);

	return SpotRepeat;
};