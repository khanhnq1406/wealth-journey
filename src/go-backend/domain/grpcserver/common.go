package grpcserver

import (
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"wealthjourney/pkg/types"
	protobufv1 "wealthjourney/protobuf/v1"
)

//nolint:unused
// Convert time to protobuf timestamp
func toProtoTimestamp(t time.Time) *timestamppb.Timestamp {
	return timestamppb.New(t)
}

//nolint:unused
// Convert proto Money to domain Money
func protoToDomainMoney(m *protobufv1.Money) types.Money {
	if m == nil {
		return types.Money{}
	}
	return types.Money{
		Amount:   m.Amount,
		Currency: m.Currency,
	}
}

//nolint:unused
// Convert domain Money to proto Money
func domainToProtoMoney(m types.Money) *protobufv1.Money {
	return &protobufv1.Money{
		Amount:   m.Amount,
		Currency: m.Currency,
	}
}

// ProtoPaginationParams converts proto pagination to domain pagination
func ProtoPaginationParams(p *protobufv1.PaginationParams) types.PaginationParams {
	if p == nil {
		return types.PaginationParams{
			Page:     1,
			PageSize: 10,
			OrderBy:  "id",
			Order:    "asc",
		}
	}
	return types.PaginationParams{
		Page:     int(p.Page),
		PageSize: int(p.PageSize),
		OrderBy:  p.OrderBy,
		Order:    p.Order,
	}
}

// DomainPaginationResult converts domain pagination to proto
func DomainPaginationResult(p types.PaginationResult) *protobufv1.PaginationResult {
	return &protobufv1.PaginationResult{
		Page:       int32(p.Page),
		PageSize:   int32(p.PageSize),
		TotalCount: int32(p.TotalCount),
		TotalPages: int32(p.TotalPages),
	}
}
