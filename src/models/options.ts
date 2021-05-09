export class Options
{
	public eco: boolean;
	public extraCare: boolean;
	public noGoLines: boolean;
	public spotCharacteristics: boolean;
	public spotRepeat: boolean;
	public spotWidth: number;
	public spotHeight: number;
	
	constructor()
	{
		this.eco = false;
		this.extraCare = false;
		this.noGoLines = false;
		this.spotCharacteristics = false;
		this.spotRepeat = false;
		this.spotWidth = 200;
		this.spotHeight = 200;
	}
}	