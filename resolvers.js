const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
const Author_mongo = require('./models/mongo_author')
const Book_mongo = require('./models/mongo_book')
const User = require('./models/Users')
const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()


const resolvers = {
    Query: {
      me: (root, args, context) => {
        return context.currentUser
      },
      allGenres: async () => {
        const books = await Book_mongo.find({})
        const genres = books.reduce((uniqueGenres, book) => {
          book.genres.forEach((genre) => {
            if (!uniqueGenres.includes(genre)) {
              uniqueGenres.push(genre)
            }
          })
          return uniqueGenres
        }, [])
        return genres
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
    Authors: {
      bookCount: async (parent) => {
        const books = await Book_mongo.find({ author: parent._id })
        return books.length
      }
    },
    Mutation: {
      addBook: async (root, args, context) => {
        // Find the author in the database
        let author = await Author_mongo.findOne({ name: args.author.name })
        const currentUser = context.currentUser
      
        if (!currentUser) {
          throw new GraphQLError('not authenticated', {
            extensions: {
              code: 'BAD_USER_INPUT',
            },
          })
        }
      
        // If the author doesn't exist, create a new author
        if (!author) {
          author = new Author_mongo({ name: args.author.name, born: args.author.born })
          try {
            await author.save()
          } catch (error) {
            throw new GraphQLError('Error adding author: ' + error.message, {
              extensions: {
                code: 'BAD_USER_INPUT',
                invalidArgs: args.author,
                error,
              },
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
            pubsub.publish('BOOK_ADDED', { bookAdded: book })
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
    // Check if favoriteGenre is provided
    if (!args.favoriteGenre) {
      throw new GraphQLError('favoriteGenre is required', {
        extensions: {
          code: 'BAD_USER_INPUT',
          invalidArgs: args,
        },
      })
    }
  
    const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
  
    return user.save()
      .catch(error => {
        throw new GraphQLError('Creating the user failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args,
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

        return { 
          value: jwt.sign(userForToken, process.env.JWT_SECRET),
          user: {
            username: user.username,
            favoriteGenre: user.favoriteGenre
          }
        }
      }
    },
    Subscription: {
        bookAdded: {
            subscribe: () => pubsub.asyncIterator('BOOK_ADDED')
        }
    }
  }
module.exports = resolvers