import { BSON } from 'bson';
import {
    Constructor,
    DecoratorFactory,
    ObjectPropertySerializer,
    TypeSerializer,
    TypeSerializerPicker,
    Util
} from 'serialazy';

import { BSONRegExp, BsonType, Double, Int32 } from './bson_type';

const BACKEND = 'bson';
const bson = new BSON();
const picker = new TypeSerializerPicker<BsonType>(BACKEND);
const decoratorFactory = new DecoratorFactory<BsonType>(BACKEND);

/**
 * Define serializer for given property or type
 * @param params _(optional)_ Custom type serializer and/or options
 * @returns Type/property decorator
 */
export function Serialize<TSerialized extends BsonType, TOriginal>(
    params?: TypeSerializer<TSerialized, TOriginal> & ObjectPropertySerializer.Options
) {
    return decoratorFactory.create(params);
}

/**
 * Serialize given serializable type instance to BSON type
 * @param serializable Serializable type instance
 * @param ctor _(optional)_ Serializable type constructor function. If provided, it overrides the type of serializable.
 * @returns BSON type (js-bson)
 */
export function deflate<TOriginal>(serializable: TOriginal, ctor?: Constructor<TOriginal>): BsonType {
    return picker.deflate(serializable, ctor);
}

/**
 * Serialize given serializable type instance to BSON binary
 * @param serializable Serializable type instance
 * @returns Buffer with BSON binary
 */
export function deflateToBinary<TOriginal>(serializable: TOriginal): Buffer {
    const bsonType = deflate(serializable);
    return bson.serialize(bsonType);
}

/**
 * Construct/deserialize a serializable type instance from BSON type
 * @param ctor Serializable type constructor function
 * @param serialized BSON object (js-bson)
 * @returns Serializable type instance
 */
export function inflate<TOriginal>(ctor: Constructor<TOriginal>, serialized: BsonType): TOriginal {
    return picker.inflate(ctor, serialized);
}

/**
 * Construct/deserialize a serializable type instance from BSON binary
 * @param ctor Serializable type constructor function
 * @param serialized Buffer with BSON binary
 * @returns Serializable type instance
 */
export function inflateFromBinary<TOriginal>(ctor: Constructor<TOriginal>, serialized: Buffer): TOriginal {

    const bsonType: BsonType = bson.deserialize(serialized, {
        promoteValues: false,
        promoteLongs: false,
        bsonRegExp: true
    });

    return inflate(ctor, bsonType);
}

// Types
export * from './bson_type';

// Define serializers for built-in types

function expectDateOrNil(maybeDate: any): Date {
    if (maybeDate === null || maybeDate === undefined) {
        return maybeDate;
    } else if (!(maybeDate instanceof Date)) {
        throw new Error(`Not a Date (typeof: "${typeof(maybeDate)}", value: "${maybeDate}")`);
    } else {
        return maybeDate;
    }
}

Serialize<boolean, boolean>({
    down: (original: any) => Util.expectBooleanOrNil(original),
    up: (serialized: any) => Util.expectBooleanOrNil(serialized)
})(Boolean);

Serialize<Double | Int32, number>({
    down: (original: any) => {
        const num = Util.expectNumberOrNil(original);
        if (num === null || num === undefined) {
            return num as null | undefined;
        } else if (Number.isInteger(num)) {
            return new Int32(num);
        } else {
            return new Double(num);
        }
    },
    up: (serialized: any) => {
        if (serialized === null || serialized === undefined) {
            return serialized as null | undefined;
        } else if (serialized._bsontype === 'Double' || serialized._bsontype === 'Int32') {
            const num = serialized.valueOf && serialized.valueOf();
            if (typeof num === 'number') {
                return num;
            }
        }
        throw new Error(`Not a Double/Int32 BSON type (typeof: "${typeof(serialized)}", value: "${serialized}")`);
    }
})(Number);

Serialize<string, string>({
    down: (original: any) => Util.expectStringOrNil(original),
    up: (serialized: any) => Util.expectStringOrNil(serialized)
})(String);

Serialize<Date, Date>({
    down: (original: any) => expectDateOrNil(original),
    up: (serialized: any) => expectDateOrNil(serialized)
})(Date);

Serialize<BSONRegExp, RegExp>({
    down: (original: any) => {
        if (original === null || original === undefined) {
            return original as null | undefined;
        } else if (!(original instanceof RegExp)) {
            throw new Error(`Not a RegExp (typeof: "${typeof(original)}", value: "${original}")`);
        } else {
            return new BSONRegExp(original.source, original.flags);
        }
    },
    up: (serialized: any) => {
        if (serialized === null || serialized === undefined) {
            return serialized as null | undefined;
        } else if (serialized._bsontype === 'BSONRegExp') {
            return new RegExp(serialized.pattern, serialized.options);
        } else {
            throw new Error(`Not a BSONRegExp (typeof: "${typeof(serialized)}", value: "${serialized}")`);
        }
    }
})(RegExp);
