import { defineClientFactory } from 'alien-rpc/client'
import * as API from './generated/api.js'

export default defineClientFactory(API)
