function write(level,event){if(process.env.NODE_ENV!=='test')console.log(JSON.stringify({level,event}));}
module.exports={write};
