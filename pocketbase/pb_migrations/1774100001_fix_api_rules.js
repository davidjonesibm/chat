/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Fix users collection rules
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_');
    unmarshal(
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
      },
      usersCollection,
    );
    app.save(usersCollection);

    // Fix groups collection rules
    const groupsCollection = app.findCollectionByNameOrId('pbc_3346940990');
    unmarshal(
      {
        listRule: "@request.auth.id != '' && members ?= @request.auth.id",
        viewRule: "@request.auth.id != '' && members ?= @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      },
      groupsCollection,
    );
    app.save(groupsCollection);

    // Fix channels collection rules
    const channelsCollection = app.findCollectionByNameOrId('pbc_3009067695');
    unmarshal(
      {
        listRule: "@request.auth.id != '' && group.members ?= @request.auth.id",
        viewRule: "@request.auth.id != '' && group.members ?= @request.auth.id",
        createRule:
          "@request.auth.id != '' && group.members ?= @request.auth.id",
        updateRule: "@request.auth.id != '' && group.owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && group.owner = @request.auth.id",
      },
      channelsCollection,
    );
    app.save(channelsCollection);

    // Fix messages collection rules
    const messagesCollection = app.findCollectionByNameOrId('pbc_2605467279');
    unmarshal(
      {
        listRule:
          "@request.auth.id != '' && channel.group.members ?= @request.auth.id",
        viewRule:
          "@request.auth.id != '' && channel.group.members ?= @request.auth.id",
        createRule:
          "@request.auth.id != '' && channel.group.members ?= @request.auth.id && sender = @request.auth.id",
        updateRule: "@request.auth.id != '' && sender = @request.auth.id",
        deleteRule:
          "@request.auth.id != '' && (sender = @request.auth.id || channel.group.owner = @request.auth.id)",
      },
      messagesCollection,
    );
    app.save(messagesCollection);

    return null;
  },
  (app) => {
    // Revert users collection rules
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_');
    unmarshal(
      {
        listRule: 'id = @request.auth.id',
        viewRule: 'id = @request.auth.id',
      },
      usersCollection,
    );
    app.save(usersCollection);

    // Revert groups collection rules
    const groupsCollection = app.findCollectionByNameOrId('pbc_3346940990');
    unmarshal(
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      },
      groupsCollection,
    );
    app.save(groupsCollection);

    // Revert channels collection rules
    const channelsCollection = app.findCollectionByNameOrId('pbc_3009067695');
    unmarshal(
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      },
      channelsCollection,
    );
    app.save(channelsCollection);

    // Revert messages collection rules
    const messagesCollection = app.findCollectionByNameOrId('pbc_2605467279');
    unmarshal(
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      },
      messagesCollection,
    );
    app.save(messagesCollection);

    return null;
  },
);
