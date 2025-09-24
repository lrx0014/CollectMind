export const colorOptions = [
    { name: 'Blue', value: '#4A90E2' },
    { name: 'Green', value: '#50E3C2' },
    { name: 'Orange', value: '#F5A623' },
    { name: 'Red', value: '#D0021B' },
    { name: 'Purple', value: '#9013FE' },
    { name: 'Teal', value: '#008080' },
];

export interface Topic {
    id: number;
    name: string;
    summary: string;
    color_tag_rgb: string;
}
