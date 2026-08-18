import 'dotenv/config';
import mongoose from 'mongoose';
import { Quotation } from '../server/models/Quotation.js';
import { Customer } from '../server/models/Customer.js';
import { Product } from '../server/models/Product.js';

const apply = process.argv.includes('--apply');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

await mongoose.connect(process.env.MONGODB_URI);
try {
  const before = {
    quotations: await Quotation.countDocuments(),
    customers: await Customer.countDocuments(),
    products: await Product.countDocuments(),
    quotationsMissingRevision: await Quotation.countDocuments({ revision: { $exists: false } }),
    quotationsMissingAssignee: await Quotation.countDocuments({ assignedTo: { $exists: false } }),
    productsMissingActive: await Product.countDocuments({ active: { $exists: false } }),
    approvedLegacyUsersMissingVerification: await mongoose.connection.collection('users').countDocuments({ status: 'active', approvedAt: { $ne: null }, emailVerifiedAt: { $exists: false } }),
  };
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', before }, null, 2));
  if (!apply) {
    console.log('Dry run complete. Re-run with --apply only after taking a database backup.');
  } else {
    await Quotation.updateMany({ revision: { $exists: false } }, { $set: { revision: 1 } });
    await Quotation.updateMany({ assignedTo: { $exists: false }, createdBy: { $ne: null } }, [{ $set: { assignedTo: '$createdBy' } }]);
    await Customer.updateMany({ assignedTo: { $exists: false }, createdBy: { $ne: null } }, [{ $set: { assignedTo: '$createdBy' } }]);
    await Product.updateMany({ active: { $exists: false } }, { $set: { active: true } });
    await mongoose.connection.collection('users').updateMany(
      { status: 'active', approvedAt: { $ne: null }, emailVerifiedAt: { $exists: false } },
      [{ $set: { emailVerifiedAt: '$approvedAt' } }],
    );
    const after = {
      quotations: await Quotation.countDocuments(),
      customers: await Customer.countDocuments(),
      products: await Product.countDocuments(),
      quotationsMissingRevision: await Quotation.countDocuments({ revision: { $exists: false } }),
      quotationsMissingAssignee: await Quotation.countDocuments({ assignedTo: { $exists: false } }),
      productsMissingActive: await Product.countDocuments({ active: { $exists: false } }),
      approvedLegacyUsersMissingVerification: await mongoose.connection.collection('users').countDocuments({ status: 'active', approvedAt: { $ne: null }, emailVerifiedAt: { $exists: false } }),
    };
    if (before.quotations !== after.quotations || before.customers !== after.customers || before.products !== after.products) throw new Error('Record count verification failed');
    console.log(JSON.stringify({ mode: 'complete', after }, null, 2));
  }
} finally {
  await mongoose.disconnect();
}
