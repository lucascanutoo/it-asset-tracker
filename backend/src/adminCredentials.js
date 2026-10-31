const {scryptSync,timingSafeEqual}=require('node:crypto');
const normalizeUsername=value=>String(value||'').trim().toLowerCase();
// Public fictional accounts; these are not secrets or production credentials.
const salt='portfolio-demo-public-salt';
const passwordHash='scrypt$'+salt+'$'+scryptSync('Demo-Portfolio-2026!',salt,64).toString('hex');
const accounts=['demo.admin','demo.gestor'].map(username=>({username,passwordHash,mustChangePassword:false}));
async function readAdmins(){return accounts;}
async function verifyPassword(password,hash){const [,s,h]=String(hash).split('$');if(typeof password!=='string'||!s||!h)return false;const stored=Buffer.from(h,'hex');const actual=scryptSync(password,s,64);return stored.length===actual.length&&timingSafeEqual(stored,actual);}
async function hashPassword(){throw Object.assign(Error('Contas da demo são fixas.'),{status:403});}
async function changeAdminPassword(){throw Object.assign(Error('Contas da demo são fixas.'),{status:403});}
module.exports={normalizeUsername,readAdmins,verifyPassword,hashPassword,changeAdminPassword};
