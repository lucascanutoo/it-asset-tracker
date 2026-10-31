function authorize(...roles) { return (req,res,next) => roles.includes(req.user?.role) ? next() : res.status(403).json({message:'Seu perfil não permite esta operação.'}); }
module.exports={authorize};
