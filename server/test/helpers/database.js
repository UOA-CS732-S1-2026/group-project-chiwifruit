jest.unmock('mongoose')

const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

let mongoServer

async function connectIntegrationDatabase() {
  if (mongoServer) return mongoServer

  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'kichain-integration-test',
  })

  return mongoServer
}

async function clearIntegrationDatabase() {
  const collections = Object.values(mongoose.connection.collections)
  await Promise.all(collections.map((collection) => collection.deleteMany({})))
}

async function disconnectIntegrationDatabase() {
  await mongoose.disconnect()
  if (mongoServer) {
    await mongoServer.stop()
    mongoServer = null
  }
}

module.exports = {
  mongoose,
  connectIntegrationDatabase,
  clearIntegrationDatabase,
  disconnectIntegrationDatabase,
}
