const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const nodes=new Map(),events={};const node=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},addEventListener(){}})}return nodes.get(id)};
 const c={document:{getElementById:node,querySelector:node},window:{innerWidth:390,addEventListener:(name,fn)=>events[name]=fn}};
 const source=fs.readFileSync(require.resolve('../Landing/landing.js'),'utf8');
 vm.runInNewContext(source.slice(source.indexOf('const authContainer ='),source.indexOf('const isiOSDevice =')),c);
 return {c,node,events};
}
test('opening and closing the mobile keyboard preserves Create Account',()=>{
 const {c,node,events}=fixture();c.switchAuth('register');events.resize();events.resize();events.load();
 assert.equal(node('.sign-up-container').classList.contains('active-mobile'),true);
 assert.equal(node('.sign-in-container').classList.contains('active-mobile'),false);
});
test('crossing the desktop breakpoint preserves the selected auth form',()=>{
 const {c,node,events}=fixture();c.switchAuth('register');c.window.innerWidth=1200;events.resize();
 assert.equal(node('authContainer').classList.contains('right-panel-active'),true);
 c.window.innerWidth=390;events.resize();assert.equal(node('.sign-up-container').classList.contains('active-mobile'),true);
 c.switchAuth('login');events.resize();assert.equal(node('.sign-in-container').classList.contains('active-mobile'),true);
});
