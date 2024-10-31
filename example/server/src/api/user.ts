import * as uuid from '@lukeed/uuid'
import { route, t } from 'alien-rpc/service'
import toSvgDataUri from 'mini-svg-data-uri'
import { isError } from 'radashi'
import { generateUsername } from 'unique-username-generator'
import { db } from '../db.ts'

export type SignUpOptions = {
  name: string & t.MaxLength<80> & t.Pattern<'^[a-zA-Z ]+$'>
}

export const signUp = route.post(
  '/users',
  async ({}, { name }: SignUpOptions) => {
    const publishKey = uuid.v4()

    let slug = generateUsername('-', undefined, undefined, name)

    const avatarSvg = await fetch(
      `https://api.dicebear.com/9.x/lorelei/svg?seed=${slug}`,
    ).then((res) => res.text())
    const avatarUri = toSvgDataUri(avatarSvg)

    try {
      db.prepare(
        /* sql */ `
          INSERT INTO users (name, slug, avatar_url, publish_key)
          VALUES (?, ?, ?, ?)
        `,
      ).run(name, slug, avatarUri, publishKey)
    } catch (error) {
      if (isError(error) && error.message.includes('users_slug_key')) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 5)}`
      }
    }

    return { slug, avatarUri, publishKey }
  },
)
