import * as uuid from '@lukeed/uuid'
import {
  BadRequestError,
  paginate,
  route,
  t,
  UnauthorizedError,
} from 'alien-rpc/service'
import { sleep } from 'radashi'
import { db } from '../db.ts'

export const createPost = route.post(
  '/posts',
  ({}, { title, content }: { title: string; content: string }, { request }) => {
    const publishKey = request.headers.get('x-publish-key')

    if (!publishKey) {
      throw new BadRequestError('Missing x-publish-key header')
    }

    const matches = db
      .prepare(
        /* sql */ `SELECT COUNT(*) FROM user WHERE slug = ? AND publish_key = ?`,
      )
      .get(slug, publishKey) as number

    if (!matches) {
      throw new UnauthorizedError()
    }

    db.prepare(
      /* sql */ `INSERT INTO post (id, slug, title, content) VALUES (?, ?, ?, ?)`,
    ).run(uuid.v4(), slug, title, content)
  },
)

export const streamPostsByUser = route.get(
  '/user/:userId/posts',
  async function* (
    { userId }: { userId: string },
    {
      page = 1,
      limit = 10,
    }: {
      page?: number & t.Minimum<1>
      limit?: number & t.Maximum<25>
    },
  ) {
    const offset = (page - 1) * limit

    const posts = db
      .prepare(
        /* sql */ `SELECT * FROM post WHERE user_id = ? LIMIT ? OFFSET ?`,
      )
      .all(userId, limit, offset) as db.Post[]

    // Since SQLite is synchronous, let's emulate a streaming response
    for (const post of posts) {
      yield post
      await sleep(100)
    }

    return paginate(this, {
      prev: page > 1 ? { userId, page: page - 1 } : null,
      next: posts.length === limit ? { userId, page: page + 1 } : null,
    })
  },
)

/**
 * Get a list of all users, sorted by “most recently posted”.
 */
export const streamTimeline = route.get(
  '/timeline',
  async function* ({
    page = 1,
    limit = 50,
  }: {
    page?: number & t.Minimum<1>
    limit?: number & t.Maximum<100>
  }) {
    const offset = (page - 1) * limit

    const posts = db
      .prepare(
        /* sql */ `
          SELECT p.*, u.name as user_name, u.avatar_url as user_avatar_url
          FROM post p
          JOIN user u ON u.slug = p.user_slug
          ORDER BY p.created_at DESC 
          LIMIT ? OFFSET ?
        `,
      )
      .all(limit, offset) as (db.Post & { user_name: string })[]

    // Since SQLite is synchronous, let's emulate a streaming response
    for (const post of posts) {
      yield post
      await sleep(100)
    }

    return paginate(this, {
      prev: page > 1 ? { page: page - 1 } : null,
      next: posts.length === limit ? { page: page + 1 } : null,
    })
  },
)
