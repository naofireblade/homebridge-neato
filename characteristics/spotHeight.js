const inherits = require('util').inherits;

module.exports = function (Characteristic, CustomUUID)
{
	let SpotHeight = function ()
	{
		Characteristic.call(this, 'Spot ↕', CustomUUID.SpotCleanHeight);
		this.setProps({
			format: Characteristic.Formats.INT,
			unit: 'cm',
			maxValue: 400,
			minValue: 100,
			minStep: 50,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE]
		});
		this.value = this.getDefaultValue();
	};
	inherits(SpotHeight, Characteristic);

	return SpotHeight;
};