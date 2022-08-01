import { createSlice } from "@reduxjs/toolkit"
import logger from "../lib/logger"
import { createBackgroundAsyncThunk } from "./utils"
import { EVMNetwork } from "../networks"
import { setSnackbarMessage } from "./ui"

export type NFTItem = {
  media: { gateway?: string }[]
  id: {
    tokenId: string
  }
  contract: { address: string }
  title: string
  chainID?: number
}

export type NFTsState = {
  evm: {
    [chainID: string]: {
      [address: string]: NFTItem[]
    }
  }
}

export const initialState = {
  evm: {},
} as NFTsState

const NFTsSlice = createSlice({
  name: "nfts",
  initialState,
  reducers: {
    updateNFTs: (immerState, { payload: { address, NFTs, network } }) => {
      const normalizedAddress = address
      immerState.evm[network.chainID] ??= {}
      immerState.evm[network.chainID][normalizedAddress] ??= []
      immerState.evm[network.chainID][normalizedAddress] = NFTs
    },
  },
})

export const { updateNFTs } = NFTsSlice.actions

export default NFTsSlice.reducer

async function fetchNFTsByNetwork(address: string, currentNetwork: EVMNetwork) {
  // @TODO: Move to alchemy.ts, remove hardcoded polygon or eth logic
  const requestUrl = new URL(
    `https://${
      currentNetwork.name === "Polygon" ? "polygon-mainnet.g" : "eth-mainnet"
    }.alchemyapi.io/nft/v2/${process.env.ALCHEMY_KEY}/getNFTs/`
  )
  requestUrl.searchParams.set("owner", address)
  requestUrl.searchParams.set("filters[]", "SPAM")
  const result = await (await fetch(requestUrl.toString())).json()
  return result.ownedNfts
}

export const fetchThenUpdateNFTsByNetwork = createBackgroundAsyncThunk(
  "nfts/fetchThenUpdateNFTsByNetwork",
  async (
    payload: {
      address: string
      currentNetwork: EVMNetwork
    },
    { dispatch }
  ) => {
    try {
      const { address, currentNetwork } = payload
      const ownedNFTs = await fetchNFTsByNetwork(address, currentNetwork)

      await dispatch(
        NFTsSlice.actions.updateNFTs({
          address,
          NFTs: ownedNFTs,
          network: currentNetwork,
        })
      )
    } catch (error) {
      logger.error("NFTs fetch failed:", error)
      dispatch(setSnackbarMessage(`Couldn't load NFTs`))
    }
  }
)