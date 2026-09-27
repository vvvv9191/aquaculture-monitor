export const FARM_OPTIONS = [
  { id: 'zhimin', name: '天津市滨海新区志敏养殖场', shortName: '志敏养殖场' },
  { id: 'lijinshan', name: '天津市滨海新区李金山养殖场', shortName: '李金山养殖场' },
]

export const getFarmOption = (name) => FARM_OPTIONS.find((farm) => farm.name === name)
