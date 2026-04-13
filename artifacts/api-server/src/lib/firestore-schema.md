# Firestore Schema Design

This document describes the Firestore collections, document shapes, and query patterns
used by the Twitter-like backend. Follow these conventions when adding new features.

---

## Collections

### `users/{uid}`

One document per authenticated user. Created after signup via `POST /api/users`.

```
users/{uid}
  uid:            string   — Firebase Auth UID (same as document ID)
  username:       string   — unique, lowercase-indexed via /usernames collection
  displayName:    string
  bio:            string | null
  avatarUrl:      string | null
  followersCount: number   — maintained via atomic increments
  followingCount: number   — maintained via atomic increments
  postsCount:     number   — maintained via atomic increments
  createdAt:      Timestamp
```

**Why denormalized counters?** Counting with a query is expensive at scale. We use
`FieldValue.increment()` in batched writes so counts stay consistent without transactions.

---

### `usernames/{username}`

A lookup collection that enforces unique usernames across the platform.

```
usernames/{username_lowercase}
  uid: string   — the owner's UID
```

When creating a user, write to both `users/{uid}` and `usernames/{username}` in a
single batch to ensure atomicity.

---

### `posts/{postId}`

One document per post. Post IDs are auto-generated Firestore IDs.

```
posts/{postId}
  id:                string   — same as document ID (denormalized for convenience)
  authorId:          string   — uid of the author
  authorUsername:    string   — denormalized for feed rendering (avoids a join)
  authorDisplayName: string   — denormalized for feed rendering
  authorAvatarUrl:   string | null — denormalized
  content:           string   — max 280 characters
  likesCount:        number   — increment via FieldValue.increment()
  commentsCount:     number   — increment via FieldValue.increment()
  createdAt:         Timestamp
```

**Why denormalize author info?** Firestore has no joins. Embedding author fields means
a single document read gives everything needed to render a post in a feed.

**Future extensions (no schema rewrite needed):**
- Add `mediaUrls: string[]` for image/video posts
- Add `repostOf: string | null` for reposts
- Add `parentPostId: string | null` for threads

---

### `follows/{followerId_followeeId}`

One document per follow relationship. The document ID is `{followerId}_{followeeId}`.

```
follows/{followerId}_{followeeId}
  followId:   string   — same as document ID
  followerId: string   — uid of the follower
  followeeId: string   — uid of the person being followed
  createdAt:  Timestamp
```

**Why a single follows collection?** This allows efficient queries in both directions:
- `WHERE followerId == uid` → who does uid follow?
- `WHERE followeeId == uid` → who follows uid?

Both queries need a Firestore index (created automatically by single-field queries).

---

### `likes/{userId_postId}` *(ready to add)*

```
likes/{userId}_{postId}
  userId:    string
  postId:    string
  createdAt: Timestamp
```

To add likes: create this document + `FieldValue.increment(1)` on `posts/{postId}.likesCount`
in a single batch. Check existence to prevent double-likes.

---

### `comments/{commentId}` *(ready to add)*

```
comments/{commentId}
  id:                string
  postId:            string   — foreign key to posts
  authorId:          string
  authorUsername:    string   — denormalized
  authorDisplayName: string   — denormalized
  authorAvatarUrl:   string | null
  content:           string
  createdAt:         Timestamp
```

Query: `WHERE postId == id ORDER BY createdAt ASC`. Increment `posts/{postId}.commentsCount`
on create/delete via batched write.

---

## Recommended Firestore Indexes

Create these composite indexes in the Firebase Console or `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "authorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "authorId", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "follows",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "followerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "follows",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "followeeId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Example Queries

### Create a user profile (after Firebase Auth signup)

```typescript
const batch = db.batch();
batch.set(db.collection("users").doc(uid), {
  uid, username, displayName, bio: null, avatarUrl: null,
  followersCount: 0, followingCount: 0, postsCount: 0,
  createdAt: Timestamp.now(),
});
batch.set(db.collection("usernames").doc(username.toLowerCase()), { uid });
await batch.commit();
```

### Create a post

```typescript
const postRef = db.collection("posts").doc();
const batch = db.batch();
batch.set(postRef, { id: postRef.id, authorId, authorUsername, content, likesCount: 0, commentsCount: 0, createdAt: Timestamp.now() });
batch.update(db.collection("users").doc(authorId), { postsCount: FieldValue.increment(1) });
await batch.commit();
```

### Get posts by a user (cursor-based pagination)

```typescript
let query = db.collection("posts")
  .where("authorId", "==", userId)
  .orderBy("createdAt", "desc")
  .limit(21); // fetch limit+1 to detect hasMore

if (cursor) {
  const cursorDoc = await db.collection("posts").doc(cursor).get();
  query = query.startAfter(cursorDoc);
}

const snap = await query.get();
const hasMore = snap.docs.length > 20;
const posts = snap.docs.slice(0, 20);
const nextCursor = hasMore ? posts[posts.length - 1].id : null;
```

### Follow a user

```typescript
const followId = `${followerId}_${followeeId}`;
const batch = db.batch();
batch.set(db.collection("follows").doc(followId), { followId, followerId, followeeId, createdAt: Timestamp.now() });
batch.update(db.collection("users").doc(followerId), { followingCount: FieldValue.increment(1) });
batch.update(db.collection("users").doc(followeeId), { followersCount: FieldValue.increment(1) });
await batch.commit();
```

### Get feed (fan-out on read, with chunking for scale)

The feed queries posts from all followed users. Since Firestore's `in` operator is limited
to 30 values, we chunk the followee list and query in parallel.

```typescript
const followingSnap = await db.collection("follows").where("followerId", "==", uid).get();
const followeeIds = followingSnap.docs.map(d => d.data().followeeId);

// Chunk into groups of 30
const chunks = [];
for (let i = 0; i < followeeIds.length; i += 30) {
  chunks.push(followeeIds.slice(i, i + 30));
}

// Query all chunks in parallel with a robust cursor
const snaps = await Promise.all(chunks.map(chunk => {
  let q = db.collection("posts")
    .where("authorId", "in", chunk)
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc")
    .limit(limit + 1);
  if (cursor) q = q.startAfter(cursorTimestamp, cursorId);
  return q.get();
}));

// Merge, sort, and slice in memory
const merged = snaps.flatMap(s => s.docs).sort(...);
const posts = merged.slice(0, limit);
```

**Limitations:** While this handles more than 30 followees, fetching from many shards
on every request becomes inefficient at very high scale (e.g., following > 500 accounts).
Page 2 must re-query all shards using the cursor.

### Scaling Path: Fan-out on Write (Cloud Functions)
... (rest of doc) ...

---

## Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId
        && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['followersCount', 'followingCount', 'postsCount', 'createdAt']);
    }

    match /usernames/{username} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }

    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.authorId;
      allow delete: if request.auth.uid == resource.data.authorId;
    }

    match /follows/{followId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.followerId;
      allow delete: if request.auth.uid == resource.data.followerId;
    }
  }
}
```
