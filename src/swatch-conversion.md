# Swatch conversion

Each color swatch is created as Pencil frame:

```json
{
  "type": "frame",
  "id": "${id}",
  "name": "#${key}",
  "gap": 8,
  "alignItems": "center",
  "children": [
    {
      "type": "text",
      "id": "${lable_id}",
      "fill": "${value}",
      "content": "${key}",
      "fontFamily": "Inter",
      "fontSize": 10,
      "fontWeight": "normal"
    },
    {
      "type": "rectangle",
      "id": "${swatch_id}",
      "fill": "${value}",
      "width": 32,
      "height": 32
    }
  ]
}
```

- All id’s (`${id}, ${label_id}, ${swatch_id}`) are generated automatically according to Pencil guidelines.

## When parsing `"colors": {}`

- `${key}` equals key from `"colors": { "key": "value" }`
- `${value}` equals value from `"colors": { "key": "value" }`
  
## When parsing `"tokenColors":{}`

- Use concatenated strings from `"scope"` array, concatenate with `|` symbol: `${key} = scope1|scope2|…`
- Use `settings.foreground` for each object as color `${value}`
- If settings contain `fontStyle`, apply it to child `"type": "text"`