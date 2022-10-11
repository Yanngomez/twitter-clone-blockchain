import { createContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { client } from '../lib/client'

export const TwitterContext = createContext()

export const TwitterProvider = ({ children }) => {
  const [appStatus, setAppStatus] = useState('loading')
  const [currentAccount, setCurrentAccount] = useState('')
  const [currentUser, setCurrentUser] = useState({})
  const [tweets, setTweets] = useState([])
  const router = useRouter()

  useEffect(() => {
    checkIfWalletIsConnected()
  }, [])

  useEffect(() => {
    if (!currentAccount && appStatus == 'connected') return
    getCurrentUserDetails(currentAccount)
    fetchTweets()
  }, [currentAccount, appStatus])

    /**
   * Checks if there is an active wallet connection
   */
  const checkIfWalletIsConnected = async () => {
    if (!window.ethereum) return setAppStatus('noMetaMask')
    try {
      const addressArray = await window.ethereum.request({
        method: 'eth_accounts',
      })
      if (addressArray.length > 0) {
        setAppStatus('connected')
        setCurrentAccount(addressArray[0])
        createUserAccount(addressArray[0])
      } else {
        router.push('/')
        setAppStatus('notConnected')
      }
    } catch (error) {
      router.push('/')
      setAppStatus('error')
    }
  }
    
    /**
     * Initiates MetaMask wallet connection
     */
  const connectWallet = async () => {
    if (!window.ethereum) return setAppStatus('noMetaMask')
    try {
      setAppStatus('loading')

     const addressArray = await window.ethereum.request({
       method: 'eth_requestAccounts',
     })
 
     if (addressArray.length > 0) {
       setAppStatus('connected')
       setCurrentAccount(addressArray[0])
       createUserAccount(addressArray[0])
      } else {
        router.push('/')
        setAppStatus('notConnected')
      }
    } catch (error) {
      setAppStatus('error')
    }
  }
    
     /**
   * Creates an account in Sanity DB if the user does not already have one
   * @param {String} userAddress Wallet address of the currently logged in user
   */
  const createUserAccount = async (userAddress = currentAccount) => { 
    if (!window.ethereum) return setAppStatus('noMetaMask')
    try {
      const userDoc = {
        _type: 'users',
        _id: userAddress,
        name: 'Unnamed',
        isProfileImageNft: false,
        profileImage:
          'https://imgs.search.brave.com/E38QGKj3IqBb4gTNMYzTOrNyD3POEiSxW4y953DQHGU/rs:fit:1200:1200:1/g:ce/aHR0cHM6Ly9sb2dv/cy13b3JsZC5uZXQv/d3AtY29udGVudC91/cGxvYWRzLzIwMjAv/MDQvVHdpdHRlci1M/b2dvLnBuZw',
        walletAddress: userAddress,
      }
    
      await client.createIfNotExists(userDoc)
    
      setAppStatus('connected')
    } catch (error) {
      router.push('/')
      setAppStatus('error')
    }
  }

  /**
   * Generates NFT profile picture URL or returns the image URL if it's not an NFT
   * @param {String} imageUri If the user has minted a profile picture, an IPFS hash; if not then the URL of their profile picture
   * @param {Boolean} isNft Indicates whether the user has minted a profile picture
   * @returns A full URL to the profile picture
   */
  const getProfileImageUrl = async (imageUri, isNft) => {
    if (isNft) {
      return `https://gateway.pinata.cloud/ipfs/${imageUri}`
    } else {
      return imageUri
    }
  }

      /**
     * Gets all the tweets stored in Sanity DB.
     */
  const fetchTweets = async () => {
    const query = `
      *[_type == "tweets"]{
        "author": author->{name, walletAddress, profileImage, isProfileImageNft},
        tweet,
        timestamp
      }|order(timestamp desc)
      `

    // setTweets(await client.fetch(query))

    const sanityResponse = await client.fetch(query)

    setTweets([])

      /**
     * Async await not available with for..of loops.
     */
    sanityResponse.forEach(async (item) => {
      const profileImageUrl = await getProfileImageUrl(
        item.author.profileImage,
        item.author.isProfileImageNft,
      )

      if (item.author.isProfileImageNft) {
        const newItem = {
          tweet: item.tweet,
          timestamp: item.timestamp,
          author: {
            name: item.author.name,
            walletAddress: item.author.walletAddress,
            profileImage: profileImageUrl,
            isProfileImageNft: item.author.isProfileImageNft,
          },
        }

        setTweets(prevState => [...prevState, newItem])
      } else {
        setTweets(prevState => [...prevState, item])
      }
    })
  }

    /**
   * Gets the current user details from Sanity DB.
   * @param {String} userAccount Wallet address of the currently logged in user
   * @returns null
   */
  const getCurrentUserDetails = async (userAccount = currentAccount) => {
    if (appStatus !== 'connected') return

    const query = `
      *[_type == "users" && _id == "${userAccount}"]{
        "tweets": tweets[]->{timestamp, tweet}|order(timestamp desc),
        name,
        profileImage,
        isProfileImageNft,
        coverImage,
        walletAddress
      }
    `
    const sanityResponse = await client.fetch(query)

    const profileImageUrl = await getProfileImageUrl(
      sanityResponse[0].profileImage,
      sanityResponse[0].isProfileImageNft,
    )

    setCurrentUser({
      tweets: sanityResponse[0].tweets,
      name: sanityResponse[0].name,
      profileImage: profileImageUrl,
      walletAddress: sanityResponse[0].walletAddress,
      coverImage: sanityResponse[0].coverImage,
      isProfileImageNft: sanityResponse[0].isProfileImageNft,
    })
  }

  return (
    <TwitterContext.Provider 
      value={{ 
        appStatus,
        currentAccount,
        connectWallet,
        tweets,
        fetchTweets,
        setAppStatus,
        getProfileImageUrl,
        currentUser,
        getCurrentUserDetails,
      }}
    >
      {children}    
    </TwitterContext.Provider>
  )
}