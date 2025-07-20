// Data migration script to create default organization and migrate existing data
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToMultitenancy() {
  console.log('🚀 Starting multitenancy data migration...');
  
  try {
    // Step 1: Create default organization
    console.log('📋 Creating default organization...');
    
    const defaultOrg = await prisma.organization.create({
      data: {
        name: 'Default Organization',
        slug: 'default-org',
        description: 'Default organization for existing data',
        settings: {},
        // Don't link to Stack Auth team initially
        stackTeamId: null,
      },
    });
    
    console.log(`✅ Created default organization: ${defaultOrg.id}`);
    
    // Step 2: Count existing data
    const experimentsCount = await prisma.experiment.count({
      where: { organizationId: null }
    });
    
    const videosCount = await prisma.video.count({
      where: { organizationId: null }
    });
    
    console.log(`📊 Found ${experimentsCount} experiments and ${videosCount} videos to migrate`);
    
    // Step 3: Migrate experiments to default organization
    if (experimentsCount > 0) {
      console.log('🔄 Migrating experiments...');
      
      const updatedExperiments = await prisma.experiment.updateMany({
        where: { organizationId: null },
        data: { organizationId: defaultOrg.id },
      });
      
      console.log(`✅ Migrated ${updatedExperiments.count} experiments to default organization`);
    }
    
    // Step 4: Migrate videos to default organization
    if (videosCount > 0) {
      console.log('🔄 Migrating videos...');
      
      const updatedVideos = await prisma.video.updateMany({
        where: { organizationId: null },
        data: { organizationId: defaultOrg.id },
      });
      
      console.log(`✅ Migrated ${updatedVideos.count} videos to default organization`);
    }
    
    // Step 5: Verify migration
    console.log('🔍 Verifying migration...');
    
    const remainingExperiments = await prisma.experiment.count({
      where: { organizationId: null }
    });
    
    const remainingVideos = await prisma.video.count({
      where: { organizationId: null }
    });
    
    if (remainingExperiments === 0 && remainingVideos === 0) {
      console.log('✅ Migration completed successfully!');
      console.log(`📋 Default organization ID: ${defaultOrg.id}`);
      console.log(`📋 Default organization slug: ${defaultOrg.slug}`);
    } else {
      console.error(`❌ Migration incomplete: ${remainingExperiments} experiments and ${remainingVideos} videos still unmigrated`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToMultitenancy()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migrateToMultitenancy };