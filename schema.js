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
      user: User!
    }

    input AuthorInput {
      name: String!
      born: Int
    }

    type Query {
        bookCount: Int
        authorCount: Int
        allBooks(author: String, genre: String): [Book]
        allAuthors: [Authors]
        me: User
        allGenres: [String!]!
    }

    type Subscription {
      bookAdded: Book!
    }

    type Mutation {
        addBook(
            title: String!
            published: Int!
            author: AuthorInput!
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

module.exports = typeDefs