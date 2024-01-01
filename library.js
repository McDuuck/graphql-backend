const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')

const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
const Author_mongo = require('./models/mongo_author')
const Book_mongo = require('./models/mongo_book')
const User = require('./models/Users')
require('dotenv').config()

const url = process.env.MONGODB_URI

console.log('connecting to ', url)

mongoose.connect(url)
  .then(() => {
    console.log('connected')
  })
  .catch((error) => {
    console.log('error: ', error)
  })


const typeDefs = `
    type Book {
      title: String!
      published: Int!
      author: Authors!
      genres: [String!]!
      id: ID!
    }

    type Authors {
        name: String
        bookCount: Int
        born: Int
    }

    type User {
      username: String!
      favoriteGenre: String!
      id: ID!
    }

    type Token {
      value: String!
    }

    type Query {
        bookCount: Int
        authorCount: Int
        allBooks(author: String, genre: String): [Book]
        allAuthors: [Authors]
        me: User
    }

    type Mutation {
        addBook(
            title: String!
            published: Int!
            author: String!
            genres: [String!]!
        ): Book
        editAuthor(
            name: String
            setBornTo: Int
        ): Authors
        createUser(
          username: String!
          favoriteGenre: String!
        ): User
        login(
          username: String!
          password: String!
        ): Token
    }
`


const resolvers = {
    Query: {
      me: (root, args, context) => {
        return context.currentUser
      },
      
      bookCount: async () => Book_mongo.collection.countDocuments(),
      authorCount: async () => Author_mongo.collection.countDocuments(),
      allBooks: async (root, args) => {
        // If an author is provided, find their books
        if (args.author) {
            const author = await Author_mongo.findOne({ name: args.author })
            if (!author) {
                return []
            }
            return Book_mongo.find({ author: author._id })
        }
        // If a genre is provided, find books with that genre
        if (args.genre) {
            return Book_mongo.find({ genres: { $in: [args.genre] } })
        }

    
        // If no author is provided, return all books
        return Book_mongo.find({})
    },
      allAuthors: async () => Author_mongo.find({})
    },
    Book: {
      author: async (book) => {
        return await Author_mongo.findById(book.author)
      },
    },
    Mutation: {
      addBook: async (root, args, context) => {
        // Find the author in the database
        let author = await Author_mongo.findOne({ name: args.author })
        const currentUser = context.currentUser

        if (!currentUser) {
          throw new GraphQLError('not authenticated', {
            extensions: {
              code: 'BAD_USER_INPUT',
            }
          })
        }

        // If the author doesn't exist, create a new author
        if (!author) {
            author = new Author_mongo({ name: args.author, born: null })
            try {
                await author.save()
            } catch (error) {
              throw new GraphQLError('Error adding author: ' + error.message, {
                extensions: {
                  code: 'BAD_USER_INPUT',
                  invalidArgs: args.author,
                  error
                }
              })
            }
        }

        // Create the book with the author's ObjectId
        const book = new Book_mongo({
            ...args,
            author: author._id,
        });

        // Save the book to the database
        try {
            await book.save()
            return book
        } catch (error) {
          throw new GraphQLError('Error adding book: ', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args,
              error
            }
          })
        }
    },
    editAuthor: async (root, args, context) => {
      // Find the author
      let author = await Author_mongo.findOne({ name: args.name })
      const currentUser = context.currentUser

        if (!currentUser) {
          throw new GraphQLError('not authenticated', {
            extensions: {
              code: 'BAD_USER_INPUT',
            }
          })
        }
    
      // If the author doesn't exist, return null
      if (!author) {
          return null
      }
      // Updating born year
      author.born = args.setBornTo
      // Save and return the updated author
      await author.save()
      return author
  },

      createUser: async (root, args) => {
        const user = new User({ username: args.username })

        return user.save()
        .catch(error => {
          throw new GraphQLError('Creating the user failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.name,
              error
              }
            })
          })
        },

      login: async (root, args) => {
        const user = await User.findOne({ username: args.username })

        if ( !user || args.password !== 'secret' ) {
          throw new GraphQLError('wrong credentials', {
            extensions: {
              code: 'BAD_USER_INPUT'
            }
          })
        }

        const userForToken = {
          username: user.username,
          id: user._id,
        }

        return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
      }
      }
      
  }

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res}) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      )
      const currentUser = await User
      .findById(decodedToken.id)
      return { currentUser }
    }
  }
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})