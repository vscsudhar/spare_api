import fs from 'fs';
import path from 'path';

const modules = [
  'auth',
  'users',
  'products',
  'categories',
  'inventory',
  'suppliers',
  'purchases',
  'customers',
  'addresses',
  'cart',
  'wishlist',
  'orders',
  'billing',
  'rare-requests',
  'chat',
  'quotations',
  'reports',
  'settings',
  'notifications',
  'uploads'
];

const toCamelCase = (str) => {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
};

const toPascalCase = (str) => {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

const baseDir = path.resolve('src/modules');

const bootstrap = () => {
  console.log(`Starting skeleton bootstrap in ${baseDir}...`);
  
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  modules.forEach((mod) => {
    const modDir = path.join(baseDir, mod);
    if (!fs.existsSync(modDir)) {
      fs.mkdirSync(modDir, { recursive: true });
    }

    const pascal = toPascalCase(mod);
    const camel = toCamelCase(mod);

    // 1. Model
    const modelPath = path.join(modDir, `${mod}.model.js`);
    if (!fs.existsSync(modelPath)) {
      fs.writeFileSync(modelPath, `import mongoose from 'mongoose';

const ${camel}Schema = new mongoose.Schema(
  {
    // TODO: Define schema fields matching Flutter VoltSpare models
  },
  {
    timestamps: true,
  }
);

export const ${pascal} = mongoose.models.${pascal} || mongoose.model('${pascal}', ${camel}Schema);
export default ${pascal};
`);
    }

    // 2. Repository
    const repoPath = path.join(modDir, `${mod}.repository.js`);
    if (!fs.existsSync(repoPath)) {
      fs.writeFileSync(repoPath, `import ${pascal} from './${mod}.model.js';

export class ${pascal}Repository {
  async findById(id) {
    return ${pascal}.findById(id);
  }

  async findAll() {
    return ${pascal}.find();
  }

  async create(data) {
    return ${pascal}.create(data);
  }
}

export default new ${pascal}Repository();
`);
    }

    // 3. Service
    const servicePath = path.join(modDir, `${mod}.service.js`);
    if (!fs.existsSync(servicePath)) {
      fs.writeFileSync(servicePath, `import ${camel}Repository from './${mod}.repository.js';

export class ${pascal}Service {
  async getById(id) {
    return ${camel}Repository.findById(id);
  }

  async getAll() {
    return ${camel}Repository.findAll();
  }
}

export default new ${pascal}Service();
`);
    }

    // 4. Controller
    const controllerPath = path.join(modDir, `${mod}.controller.js`);
    if (!fs.existsSync(controllerPath)) {
      fs.writeFileSync(controllerPath, `import ${camel}Service from './${mod}.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class ${pascal}Controller {
  getAll = catchAsync(async (req, res) => {
    const data = await ${camel}Service.getAll();
    return sendResponse(res, 200, '${pascal} retrieved successfully', data);
  });
}

export default new ${pascal}Controller();
`);
    }

    // 5. Validator
    const validatorPath = path.join(modDir, `${mod}.validator.js`);
    if (!fs.existsSync(validatorPath)) {
      fs.writeFileSync(validatorPath, `import { z } from 'zod';

export const get${pascal}Schema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});
`);
    }

    // 6. Routes
    const routesPath = path.join(modDir, `${mod}.routes.js`);
    if (!fs.existsSync(routesPath)) {
      fs.writeFileSync(routesPath, `import { Router } from 'express';
import ${camel}Controller from './${mod}.controller.js';

const router = Router();

router.get('/', ${camel}Controller.getAll);

export default router;
`);
    }

    console.log(`✅ Bootstrapped module: ${mod}`);
  });

  console.log('Skeleton bootstrap complete!');
};

bootstrap();
