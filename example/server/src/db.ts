import sqlite from 'node:sqlite'
import { type InferTableType, table } from './sqlite/table.ts'

export const db = new sqlite.DatabaseSync(':memory:')

export declare namespace db {
  type User = InferTableType<typeof userTable>
  type Post = InferTableType<typeof postTable>
}

const userTable = table('user')
  .text('slug', { primaryKey: true })
  .text('name', { notNull: true })
  .text('avatar_url')
  .text('publish_key', { notNull: true })

const postTable = table('post')
  .integer('id', { primaryKey: true })
  .text('user_slug', { notNull: true })
  .text('title', { notNull: true })
  .text('content', { notNull: true })
  .text('created_at', { notNull: true, default: 'current_timestamp' })

db.exec(/* sql */ `
  ${postTable}
  ${userTable}

  CREATE INDEX IF NOT EXISTS idx_user_publish_key ON user(publish_key);

  -- Create five historical figures with a twist
  INSERT INTO user (slug, name, avatar_url, publish_key) VALUES
    ('cleopatra', 'Cleopatra VII', '/avatars/cleopatra.jpeg', 'pk_cleo789'),
    ('napoleon', 'Napoleon Bonaparte', '/avatars/napoleon.jpeg', 'pk_nap123'),
    ('davinci', 'Leonardo da Vinci', '/avatars/davinci.jpeg', 'pk_leo456'),
    ('curie', 'Marie Curie', '/avatars/curie.jpeg', 'pk_marie789'),
    ('tesla', 'Nikola Tesla', '/avatars/tesla.jpeg', 'pk_tesla123');

  -- Create their posts
  INSERT INTO post (user_slug, title, content, created_at) VALUES
    ('cleopatra', 'Snake Warning', 'Be careful with those Egyptian cobras everyone! **Very dangerous**. *Not suitable as pets.* Stay safe!', '0030-08-12'),
    ('napoleon', 'Height Facts', 'Actually, I was **5''6"** which was *average* for my time. These short jokes are getting old.', '1815-06-18'), 
    ('davinci', 'New Flying Machine', 'Check out my **latest helicopter design**! *Also, does anyone know a good patent lawyer?*', '1485-04-15'),
    ('davinci', 'Time Machine Success!', 'Just got back from the **year 2024**! *Mind-blowing experience.* The Mona Lisa is still doing great, but these "selfies" people keep taking with her are quite peculiar...', '2024-01-15'),
    ('curie', 'Glowing Review', 'My new element is **literally glowing**! *So excited!* #RadiumGang', '1898-07-18'),
    ('tesla', 'Wireless Power', 'First post from my **wireless-powered phone**! *Signal is great at Wardenclyffe.*', '1901-03-01'),
    ('tesla', 'Pigeon Update', 'My **favorite pigeon** learned to solve *differential equations* today. So proud!', '1922-01-07');
`)
