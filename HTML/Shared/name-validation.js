(function(root) {
  const blocked = new Set(`
gago|gaga|gagi|gagu|tanga|tengga|bobo|bobong|ulol|olol|tarantado|tarantada|kupal|kupalin
putangina|putang ina|puta|putragis|putragis ka|putek|pucha|puchangina|punyeta|pakshet|pakshit|pakyu|pak you|pak yu|pakyew
leche|letse|lintik|bwisit|buwisit|hayop ka|hinayupak|walanghiya|walang hiya|siraulo|sira ulo|engot|inutil|ungas|gunggong|ogag
buwaka ng ina|kingina|tangina|tang ina|tanginamo|tangina mo|taena|taenamo|ampota|ampucha|kantot|kantutan|tite|burat|puke|pekpek|betlog|bayag|jakol|jabol|tae|taena ka
gaguhan|kagaguhan|katarantaduhan|kabulastugan|bastos|manyaks|manyak|hindot|hindutan|pesteng yawa|yawa|pisti|peste|pesteng buhay|demonyo ka|animal ka
bwakanangina|putanginamo|putang ina mo|gago ka|bobo ka|tanga ka|ulol ka|kupal ka|tarantado ka|punyeta ka|tangina nyo|tangina niyo|tanginang|lintik ka|bwisit ka|putanginang|pakshet ka|pakyu ka|pakyu mo|gagong|bobong gago|ulol mo|tarantadong|leche ka|gagawin kang tanga|pesteng yawa ka|siraulo ka
fuck|fucking|fucker|fucked|fuckoff|fuck off|fuck you|motherfucker|motherfucking|shit|shitty|bullshit|horseshit|dipshit|shithead|dumbshit|jackshit
ass|asshole|asshat|asswipe|dumbass|smartass|jackass|badass|bastard|bitch|bitches|son of a bitch|sonofabitch|damn|dammit|goddamn|goddammit|hell|what the hell|crap|crappy|piss|pissed|piss off
dick|dickhead|dickwad|cock|cocksucker|prick|wanker|twat|cunt|pussy|douche|douchebag|scumbag|dirtbag|shitbag|fuckface|fuckwit|fuckhead|dumbfuck|clusterfuck
screw you|screw off|jerk|jerkoff|moron|idiot|imbecile|retard|stupid|dumb|loser|creep|pervert|slut|whore|skank|hoe|freaking|frigging|bloody hell|bugger|bollocks|arse|arsehole|knobhead|tosser|git|shag|shagging|wank|jerkwad|butthead|assclown|shitfaced|pisshead|fuckup|fuckboy|fuckgirl|bitchy
son of a gun|holy shit|holy fuck|no shit|piece of shit|piece of crap|eat shit|kiss my ass|suck my dick|suck it|up yours|screw this|fuck this|fuck that
`.trim().split(/[|\r\n]+/));
  // Match complete words and phrases so names such as Cassie and Dickson remain valid.
  function containsBlocked(text) {
    const padded = ` ${text} `;
    return [...blocked].some(term => padded.includes(` ${term} `));
  }
  function validate(value) {
    const name = String(value || '').trim();
    if (!name) return 'Please enter your full name.';
    if (name.length > 30) return 'Full name must be 30 characters or fewer.';
    const normalized = name.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[013457@$]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s'}[c]));
    const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
    const phrases = tokens.join(' ');
    const spaced = phrases.replace(/\b(?:[a-z] ){2,}[a-z]\b/g,word=>word.replace(/ /g,''));
    if (containsBlocked(phrases) || containsBlocked(spaced)) return 'Please enter your real full name without inappropriate words.';
    if (/\p{N}/u.test(name)) return 'Full name cannot contain numbers.';
    return '';
  }
  const api={validate};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.GMNameValidation=api;
})(typeof globalThis==='object'?globalThis:this);
