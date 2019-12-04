import { useApolloClient } from "@apollo/react-hooks";
import gql from "graphql-tag";

const getTaxRatesQuery = gql`
  query getTaxRates($shopId: ID!, $first: ConnectionLimitInt, $offset: Int) {
    taxRates(shopId: $shopId, first: $first, offset: $offset) {
      nodes {
        _id
        country
        postal
        rate
        region
        taxCode
      }
      totalCount
    }
  }
`;

/**
 * @summary React hook that returns the custom tax rates for a shop
 * @param {String} shopId Shop ID
 * @param {Number} first Number of results to fetch initially and each time `fetchMoreTaxRates` is called
 * @return {Object} An object with `taxRates` property, which may be an empty array.
 *  The `isLoadingTaxRates` property will be `true` until the query is done running.
 */
export default function useCustomTaxRates(shopId) {
  const client = useApolloClient();

  return {
    fetchTaxRates: async ({ first = 20, offset = 0 }) => {
      const { called, data, loading } = await client.query({
        query: getTaxRatesQuery,
        variables: {
          first,
          offset,
          shopId
        }
      });

      return {
        isLoadingTaxRates: loading || !called,
        refetchTaxRates: () => {},
        taxRates: (data && data.taxRates && data.taxRates.nodes) || [],
        totalTaxRatesCount: (data && data.taxRates && data.taxRates.totalCount) || 0
      };
    }
  };
}
