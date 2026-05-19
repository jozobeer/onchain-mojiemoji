import { keccak256 } from 'ethers'
import MerkleTree from 'merkletreejs'

export default (addresses: string[]) => {
    const leaves = addresses.map(keccak256)
    return new MerkleTree(leaves, keccak256, { sort: true })
}