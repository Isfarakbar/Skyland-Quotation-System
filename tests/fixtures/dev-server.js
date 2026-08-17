import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';

const memory = await MongoMemoryServer.create();
Object.assign(process.env, {
  MONGODB_URI: memory.getUri(), NODE_ENV: 'development', SKYLAND_FIXTURE: '1', BOOTSTRAP_ON_START: '1',
  SUPER_ADMIN_EMAIL: 'superadmin@skyland.test', SUPER_ADMIN_PASSWORD: 'VisualAudit123',
  SUPER_ADMIN_FIRST_NAME: 'Isfar', SUPER_ADMIN_LAST_NAME: 'Akbar', SUPER_ADMIN_PHONE: '03000000000',
  SUPER_ADMIN_CNIC: '00000-0000000-0', EMAIL_DISABLED: '1', APP_URL: 'http://127.0.0.1:3100',
  CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'fixture',
});

const [{ default: app }, { connectDB }, { seedMongoDB }, { User }, { Customer }, { Quotation }] = await Promise.all([
  import('../../server/index.js'), import('../../server/db.js'), import('../../server/seed.js'), import('../../server/models/User.js'),
  import('../../server/models/Customer.js'), import('../../server/models/Quotation.js'),
]);
await connectDB(); await seedMongoDB();
const superAdmin = await User.findOne({ email: 'superadmin@skyland.test' });
const manager = await User.create({ firstName:'Ahsan',lastName:'Raza',email:'manager@skyland.test',passwordHash:await bcrypt.hash('VisualAudit123',4),phone:'03101234567',dateOfBirth:'1990-01-01',gender:'male',cnic:'11111-1111111-1',address:'Lahore',city:'Lahore',department:'Sales',designation:'Sales Manager',emergencyContactName:'Office',emergencyContactPhone:'03000000000',role:'manager',status:'active',emailVerifiedAt:new Date(),approvedAt:new Date() });
const employee = await User.create({ firstName:'Iqra',lastName:'Land',email:'employee@skyland.test',passwordHash:await bcrypt.hash('VisualAudit123',4),phone:'03108134370',dateOfBirth:'1995-02-02',gender:'female',cnic:'22222-2222222-2',address:'Lahore',city:'Lahore',department:'Sales',designation:'Telemarketing',emergencyContactName:'Office',emergencyContactPhone:'03000000000',role:'employee',status:'active',emailVerifiedAt:new Date(),approvedAt:new Date() });
const customer = await Customer.create({ name:'Ali Solar Industries',phone:'03001234567',whatsapp:'03001234567',email:'ali@example.com',city:'Lahore',projectType:'commercial',address:'Johar Town, Lahore',createdBy:superAdmin.id,assignedTo:superAdmin.id });
await Customer.create({ name:'Fatima Residence',phone:'03211234567',email:'fatima@example.com',city:'Islamabad',projectType:'residential',createdBy:superAdmin.id,assignedTo:superAdmin.id });
await Quotation.create({ quotationNumber:'SLE-260817-10001',customerId:customer.id,systemSize:10,systemType:'ongrid',items:[{name:'Complete 10kW solar package',category:'service',quantity:1,unitPrice:1625000,total:1625000}],subtotal:1625000,grandTotal:1625000,discount:0,taxRate:0,status:'sent',revision:1,followUpAt:new Date(Date.now()-86400000),createdBy:superAdmin.id,assignedTo:superAdmin.id,updatedBy:superAdmin.id,statusHistory:[{status:'sent',changedBy:superAdmin.id}] });

const server = app.listen(5001, () => console.log('Fixture API: http://127.0.0.1:5001 | superadmin@skyland.test / VisualAudit123'));
async function close(){server.close();await memory.stop();process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close);
