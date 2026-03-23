/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2605467279');

    // rename the 'field' text column to 'content'
    unmarshal(
      {
        fields: [
          {
            autogeneratePattern: '',
            hidden: false,
            id: 'text1542800728',
            max: 0,
            min: 0,
            name: 'content',
            pattern: '',
            presentable: false,
            primaryKey: false,
            required: true,
            system: false,
            type: 'text',
          },
        ],
      },
      collection,
    );

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2605467279');

    unmarshal(
      {
        fields: [
          {
            autogeneratePattern: '',
            hidden: false,
            id: 'text1542800728',
            max: 0,
            min: 0,
            name: 'field',
            pattern: '',
            presentable: false,
            primaryKey: false,
            required: true,
            system: false,
            type: 'text',
          },
        ],
      },
      collection,
    );

    return app.save(collection);
  },
);
