/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('_pb_users_auth_');

    // add username field
    collection.fields.addAt(
      6,
      new Field({
        autogeneratePattern: '',
        hidden: false,
        id: 'text_username',
        max: 50,
        min: 3,
        name: 'username',
        pattern: '^[a-zA-Z0-9_]+$',
        presentable: true,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text',
      }),
    );

    // add unique index on username
    collection.indexes = [
      'CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `users` (`tokenKey`)',
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''",
      'CREATE UNIQUE INDEX `idx_username__pb_users_auth_` ON `users` (`username`)',
    ];

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('_pb_users_auth_');

    // remove username field
    collection.fields.removeById('text_username');

    // remove username index
    collection.indexes = [
      'CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `users` (`tokenKey`)',
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''",
    ];

    return app.save(collection);
  },
);
